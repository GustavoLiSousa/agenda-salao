/** Aparece na hora em que a aba é clicada, enquanto os dados da página chegam. */
export default function Loading() {
  const bar = "animate-pulse rounded-lg bg-stone-200/80 dark:bg-stone-800";
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-4">
      <div className={`h-7 w-48 ${bar}`} />
      {[0, 1, 2].map((i) => (
        <section
          key={i}
          className="space-y-3 rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900"
        >
          <div className={`h-4 w-1/3 ${bar}`} />
          <div className={`h-4 w-2/3 ${bar}`} />
          <div className={`h-4 w-1/2 ${bar}`} />
        </section>
      ))}
    </div>
  );
}
