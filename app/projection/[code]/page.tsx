export default function ProjectionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-6xl font-extrabold tracking-tight">
        LOGIK <span className="text-blue-400">GAME</span>
      </h1>
      <p className="mt-4 text-xl text-gray-400">
        En attente du lancement de la session...
      </p>
    </div>
  );
}
