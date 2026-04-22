export const Logo = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="relative h-7 w-7 rounded-md gradient-accent shadow-glow grid place-items-center">
      <span className="font-display text-[15px] font-bold text-background">U</span>
    </div>
    <div className="font-display text-base font-bold tracking-tight">
      unmark<span className="text-primary">.</span>
    </div>
  </div>
);
