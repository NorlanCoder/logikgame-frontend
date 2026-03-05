export default function PlayerGamePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Salle de jeu</h1>
        <p className="mt-4 text-gray-400">
          En attente du lancement de la session par l&apos;administrateur...
        </p>
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:0ms]" />
          <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:150ms]" />
          <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
