'use client';

interface TimeSettingsProps {
  workTime: number;
  setWorkTime: (time: number) => void;
  breakTime: number;
  setBreakTime: (time: number) => void;
}

const TimeSettings: React.FC<TimeSettingsProps> = ({ workTime, setWorkTime, breakTime, setBreakTime }) => {
  return (
    <div className="mt-8 p-6 bg-gray-700 rounded-lg">
      <h3 className="text-lg font-bold text-white mb-4 text-center">Timer Settings (minutes)</h3>
      <div className="flex justify-center items-center space-x-4">
        <div>
          <label htmlFor="work-time" className="block text-sm font-medium text-gray-300">Work</label>
          <input
            id="work-time"
            type="number"
            value={workTime}
            onChange={(e) => setWorkTime(parseInt(e.target.value, 10))}
            className="w-24 p-2 text-black rounded"
            min="1"
          />
        </div>
        <div>
          <label htmlFor="break-time" className="block text-sm font-medium text-gray-300">Break</label>
          <input
            id="break-time"
            type="number"
            value={breakTime}
            onChange={(e) => setBreakTime(parseInt(e.target.value, 10))}
            className="w-24 p-2 text-black rounded"
            min="1"
          />
        </div>
      </div>
    </div>
  );
};

export default TimeSettings;
