export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-3 pb-10">
      <h1 className="text-3xl font-semibold tracking-[-0.025em] sm:text-[2.5rem] sm:leading-[1.1]">
        {title}
      </h1>
      {description && (
        <p className="max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>
      )}
    </div>
  );
}
