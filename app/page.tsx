import Image from "next/image";
import Spreadsheet from './components/Spreadsheet';

export default function Home() {
  return (
    <div className="w-full h-screen">
      <main className="h-full flex flex-col">
        <div className="flex-1">
          <Spreadsheet />
        </div>
      </main>
    </div>
  );
}
