
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server, Socket } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const DEFAULT_WORK_DURATION = 25 * 60;
const DEFAULT_BREAK_DURATION = 5 * 60;

// 部屋ごとのタイマー状態を管理するオブジェクト
interface RoomState {
  time: number;
  isActive: boolean;
  phase: 'work' | 'break';
  workDuration: number;
  breakDuration: number;
  interval?: NodeJS.Timeout;
  completedPomodoros: number; // 追加：完了したポモドーロの回数
}
const rooms: Record<string, RoomState> = {};

// --- 安全なタイマー停止関数 --- 
const stopTimerForRoom = (roomId: string) => {
    if (rooms[roomId] && rooms[roomId].interval) {
        clearInterval(rooms[roomId].interval!);
        rooms[roomId].interval = undefined;
    }
}

const startTimer = (io: Server, roomId: string) => {
  if (!rooms[roomId] || rooms[roomId].isActive) return;

  const room = rooms[roomId];
  room.isActive = true;
  // ★追加：タイマー開始をクライアントに通知
  io.to(roomId).emit('timer:stateChanged', room);
  stopTimerForRoom(roomId); // 念のため、開始前に既存のタイマーをクリア

  room.interval = setInterval(() => {
    if (room.time > 0) {
        room.time -= 1;
        // 毎秒、時間だけを送信
        io.to(roomId).emit('timer:tick', { time: room.time });
    } else {
        // フェーズ移行ロジック
        if (room.phase === 'work') {
            room.completedPomodoros += 1; // ★ポモドーロ完了！
            room.phase = 'break';
            room.time = room.breakDuration;
        } else {
            room.phase = 'work';
            room.time = room.workDuration;
        }
        // 状態が大きく変わった時だけ、全体の情報を送信
        io.to(roomId).emit('timer:stateChanged', room);
    }
  }, 1000);
};

const pauseTimer = (io: Server, roomId: string) => {
  if (!rooms[roomId] || !rooms[roomId].isActive) return;
  
  stopTimerForRoom(roomId);
  rooms[roomId].isActive = false;
  // 停止した状態を即座に通知
  io.to(roomId).emit('timer:stateChanged', rooms[roomId]);
};

const resetTimer = (io: Server, roomId: string) => {
    if (!rooms[roomId]) return;
    const room = rooms[roomId];

    stopTimerForRoom(roomId);
    room.isActive = false;
    room.phase = 'work';
    room.time = room.workDuration;
    room.completedPomodoros = 0; // リセット
    // リセットした状態を即座に通知
    io.to(roomId).emit('timer:stateChanged', room);
}

// ★フェーズを強制的に切り替える関数
const togglePhase = (io: Server, roomId: string) => {
    if (!rooms[roomId]) return;
    const room = rooms[roomId];
    const wasActive = room.isActive; // ★タイマーが動いていたか覚えておく

    // 1. タイマーを完全に停止し、状態も「非アクティブ」に更新する
    stopTimerForRoom(roomId);
    room.isActive = false;

    // 2. フェーズを切り替える
    if (room.phase === 'work') {
        room.phase = 'break';
        room.time = room.breakDuration;
    } else {
        room.phase = 'work';
        room.time = room.workDuration;
    }

    // 3. もし元々タイマーが動いていたなら、新しい状態でタイマーを再開する
    if (wasActive) {
        startTimer(io, roomId); // startTimerがisActiveをtrueにし、stateChangedをemitする
    } else {
        // もし止まっていたなら、新しい状態を通知するだけ
        io.to(roomId).emit('timer:stateChanged', room);
    }
};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);

  io.on('connection', (socket: Socket) => {
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
          phase: 'work',
          completedPomodoros: 0 // 初期化
        };
      }
      // 参加したユーザーに現在のタイマー状態を送信
      socket.emit('timer:stateChanged', rooms[roomId]);
    });

    socket.on('timer:start', (roomId: string) => {
      startTimer(io, roomId);
    });

    socket.on('timer:pause', (roomId: string) => {
      pauseTimer(io, roomId);
    });

    socket.on('timer:reset', (roomId: string) => {
      resetTimer(io, roomId);
    });

    // ★フェーズ切り替えイベントのハンドラを追加
    socket.on('timer:togglePhase', (roomId: string) => {
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
