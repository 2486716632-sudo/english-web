export default function ListeningLoading() {
  return (
    <div className="min-h-screen bg-[#F8F6F4]">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="h-10 w-20 bg-stone-100 rounded-full animate-pulse mb-8" />
      </div>
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        {[1, 2, 3].map(section => (
          <div key={section}>
            <div className="h-6 w-32 bg-stone-100 rounded animate-pulse mb-5" />
            <div className="flex gap-4">
              {[1, 2, 3, 4].map(card => (
                <div
                  key={card}
                  className="w-52 h-28 rounded-2xl bg-stone-100 animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
