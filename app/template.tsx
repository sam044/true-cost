// Re-mounts on every navigation, so each screen gets one short arrival.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
