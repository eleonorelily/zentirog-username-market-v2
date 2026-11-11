const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090a0d] text-[#eaebee] font-mono">
      <div className="text-center border border-[#23252c] bg-[#101115] p-8 max-w-sm w-full">
        <h1 className="text-4xl font-bold mb-3 text-[#d4af37]">404</h1>
        <p className="text-sm text-neutral-400 mb-6">Resource not located in vault.</p>
        <a href="/" className="px-4 py-2 bg-[#d4af37] text-[#090a0d] font-bold text-xs uppercase tracking-wider inline-block">
          Return to Market
        </a>
      </div>
    </div>
  );
};

export default NotFound;
