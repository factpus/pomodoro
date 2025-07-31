'use client';

interface TimeSettingsProps {
  workTime: number;
  setWorkTime: (time: number) => void;
  breakTime: number;
  setBreakTime: (time: number) => void;
}

const TimeSettings = ({ workTime, setWorkTime, breakTime, setBreakTime }: TimeSettingsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="space-y-2">
        <label htmlFor="workTime" className="text-sm font-medium text-gray-300">Work Duration (minutes)</label>
        <input
          id="workTime"
          type="number"
          value={workTime}
          onChange={(e) => setWorkTime(Number(e.target.value))}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          min="1"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="breakTime" className="text-sm font-medium text-gray-300">Break Duration (minutes)</label>
        <input
          id="breakTime"
          type="number"
          value={breakTime}
          onChange={(e) => setBreakTime(Number(e.target.value))}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          min="1"
        />
      </div>
    </div>
  );
};

export default TimeSettings;