import React from 'react';

const ShimmerLoader = ({ 
  count = 5, 
  type = 'table',
  rows = 5,
  cols = 6,
  height = '300px'
}) => {
  const shimmerStyle = \
    @keyframes shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }
    .shimmer {
      background: linear-gradient(
        90deg,
        rgba(200, 200, 200, 0.2) 25%,
        rgba(200, 200, 200, 0.3) 50%,
        rgba(200, 200, 200, 0.2) 75%
      );
      background-size: 1000px 100%;
      animation: shimmer 2s infinite;
    }
  \;

  if (type === 'table') {
    return (
      <>
        <style>{\\\}</style>
        <div className="w-full overflow-hidden">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div key={rowIdx} className="flex gap-4 py-4 border-b dark:border-gray-700">
              {Array.from({ length: cols }).map((_, colIdx) => (
                <div
                  key={colIdx}
                  className="shimmer flex-1 h-4 rounded dark:bg-gray-700"
                />
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (type === 'card') {
    return (
      <>
        <style>{\\\}</style>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: count }).map((_, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <div className="shimmer h-4 w-24 rounded mb-4" />
              <div className="shimmer h-8 w-full rounded mb-2" />
              <div className="shimmer h-4 w-32 rounded" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (type === 'chart') {
    return (
      <>
        <style>{\\\}</style>
        <div style={{ height }} className="w-full bg-white dark:bg-gray-800 rounded-lg p-6">
          <div className="shimmer h-4 w-40 rounded mb-6" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex gap-2">
                <div className="shimmer h-12 w-12 rounded" />
                <div className="shimmer flex-1 h-12 rounded" />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{\\\}</style>
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="shimmer h-4 w-full rounded" />
        ))}
      </div>
    </>
  );
};

export default ShimmerLoader;
