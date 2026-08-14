import { getChatGPTUser } from "./chatgpt-auth";
import GameClient from "./components/GameClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <main className="game-page">
      <GameClient player={user ? { displayName: user.displayName } : null} />
    </main>
  );
}
