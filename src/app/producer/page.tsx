import { ProducerChat } from "@/components/producer/ProducerChat";

export const metadata = {
  title: "Al-Nabi Producer Chat",
  description:
    "Creative Co-Pilot — vision, voice, and Foley in one native engine",
};

export default function ProducerPage() {
  return (
    <div className="mx-auto max-w-6xl pb-8 md:pb-4">
      <ProducerChat />
    </div>
  );
}
