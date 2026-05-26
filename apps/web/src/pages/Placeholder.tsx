interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="p-8">
      <h1 className="font-title text-3xl font-bold text-slate-800 mb-2">{title}</h1>
      <p className="text-slate-500">Cette section sera développée dans les prochaines étapes.</p>
    </div>
  )
}
