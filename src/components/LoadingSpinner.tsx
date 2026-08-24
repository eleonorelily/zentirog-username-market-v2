
const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center py-16">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-16 h-16 border-4 border-purple-400/30 rounded-full animate-spin border-t-purple-400"></div>
        {/* Inner ring */}
        <div className="absolute top-2 left-2 w-12 h-12 border-4 border-pink-400/30 rounded-full animate-spin border-t-pink-400 animate-reverse"></div>
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-pulse"></div>
      </div>
      <p className="ml-4 text-white/80 text-lg">Loading magical usernames...</p>
    </div>
  );
};

export default LoadingSpinner;
