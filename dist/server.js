"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const dev = process.env.NODE_ENV !== 'production';
const app = (0, next_1.default)({ dev });
const handle = app.getRequestHandler();
const DEFAULT_WORK_DURATION = 25 * 60;
const DEFAULT_BREAK_DURATION = 5 * 60;
const rooms = {};
// --- 安全なタイマー停止関数 --- 
const stopTimerForRoom = (roomId) => {
    if (rooms[roomId] && rooms[roomId].interval) {
        clearInterval(rooms[roomId].interval);
        rooms[roomId].interval = undefined;
    }
};
const startTimer = (io, roomId) => {
    if (!rooms[roomId] || rooms[roomId].isActive)
        return;
    const room = rooms[roomId];
    room.isActive = true;
    // stopTimerForRoom(roomId); // 念のため、開始前に既存のタイマーをクリア
    room.interval = setInterval(() => {
        if (room.time > 0) {
            room.time -= 1;
        }
        else {
            // フェーズ移行ロジック
            if (room.phase === 'work') {
                room.phase = 'break';
                room.time = room.breakDuration;
            }
            else {
                room.phase = 'work';
                room.time = room.workDuration;
            }
        }
        // 常に現在の状態を送信
        io.to(roomId).emit('timer:tick', {
            time: room.time,
            isActive: room.isActive,
            phase: room.phase
        });
    }, 1000);
};
const pauseTimer = (io, roomId) => {
    if (!rooms[roomId] || !rooms[roomId].isActive)
        return;
    stopTimerForRoom(roomId);
    rooms[roomId].isActive = false;
    // 停止した状態を即座に通知
    io.to(roomId).emit('timer:tick', rooms[roomId]);
};
const resetTimer = (io, roomId) => {
    if (!rooms[roomId])
        return;
    const room = rooms[roomId];
    stopTimerForRoom(roomId);
    room.isActive = false;
    room.phase = 'work';
    room.time = room.workDuration;
    // リセットした状態を即座に通知
    io.to(roomId).emit('timer:tick', room);
};
// ★フェーズを強制的に切り替える関数
const togglePhase = (io, roomId) => {
    if (!rooms[roomId])
        return;
    const room = rooms[roomId];
    // 現在のタイマーを停止
    stopTimerForRoom(roomId);
    // フェーズを切り替える
    if (room.phase === 'work') {
        room.phase = 'break';
        room.time = room.breakDuration;
    }
    else {
        room.phase = 'work';
        room.time = room.workDuration;
    }
    // isActiveはそのまま（動いていれば動いたまま、止まっていれば止まったまま）
    // 新しいフェーズの状態を全員に通知
    io.to(roomId).emit('timer:tick', room);
    // フェーズを切り替えたら、常にタイマーを開始する
    startTimer(io, roomId);
};
app.prepare().then(() => {
    const httpServer = (0, http_1.createServer)((req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url, true);
        handle(req, res, parsedUrl);
    });
    const io = new socket_io_1.Server(httpServer);
    io.on('connection', (socket) => {
        console.log(`a user connected: ${socket.id}`);
        socket.on('room:join', ({ roomId, settings }) => {
            socket.join(roomId);
            if (!rooms[roomId]) {
                const workDuration = settings.workTime ? settings.workTime * 60 : DEFAULT_WORK_DURATION;
                const breakDuration = settings.breakTime ? settings.breakTime * 60 : DEFAULT_BREAK_DURATION;
                rooms[roomId] = {
                    workDuration,
                    breakDuration,
                    time: workDuration,
                    isActive: false,
                    phase: 'work'
                };
            }
            // 参加したユーザーに現在のタイマー状態を送信
            socket.emit('timer:tick', rooms[roomId]);
        });
        socket.on('timer:start', (roomId) => {
            startTimer(io, roomId);
        });
        socket.on('timer:pause', (roomId) => {
            pauseTimer(io, roomId);
        });
        socket.on('timer:reset', (roomId) => {
            resetTimer(io, roomId);
        });
        // ★フェーズ切り替えイベントのハンドラを追加
        socket.on('timer:togglePhase', (roomId) => {
            togglePhase(io, roomId);
        });
        socket.on('disconnect', () => {
            console.log(`user disconnected: ${socket.id}`);
        });
    });
    const port = process.env.PORT || 3000;
    httpServer.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
