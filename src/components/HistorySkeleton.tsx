export default function HistorySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="p-4 rounded-lg flex gap-4 items-start animate-pulse"
          style={{ backgroundColor: '#1F1F1F' }}
        >
          <div
            className="w-20 h-20 rounded flex-shrink-0"
            style={{ backgroundColor: '#4A52EB', opacity: 0.3 }}
          />

          <div className="flex-grow space-y-2">
            <div
              className="h-6 rounded"
              style={{ backgroundColor: '#4A52EB', opacity: 0.3, width: '70%' }}
            />
            <div
              className="h-4 rounded"
              style={{ backgroundColor: '#4A52EB', opacity: 0.2, width: '50%' }}
            />
            <div
              className="h-4 rounded"
              style={{ backgroundColor: '#4A52EB', opacity: 0.2, width: '60%' }}
            />
            <div
              className="h-3 rounded"
              style={{ backgroundColor: '#4A52EB', opacity: 0.1, width: '30%' }}
            />
          </div>

          <div
            className="w-5 h-5 rounded flex-shrink-0"
            style={{ backgroundColor: '#4A52EB', opacity: 0.2 }}
          />
        </div>
      ))}
    </div>
  );
}