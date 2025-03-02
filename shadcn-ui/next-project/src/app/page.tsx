import { Button } from "@/components/ui/button";
import { Button as Button2 } from "@/components/ui/button_css-variables";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <Button>123456</Button>
      <Button2>123456</Button2>
    </div>
  );
}
