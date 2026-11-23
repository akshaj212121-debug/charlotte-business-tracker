import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import Simulator from "@/components/simulator/Simulator";

export const metadata: Metadata = {
  title: "Paper trading simulator (fake money)",
  description: "Practice buying and selling stocks with virtual money and real market prices. A simulator only: no real money, no broker, not investment advice.",
};

export default function SimulatorPage() {
  return (
    <>
      <PageTitle kicker="Practice · Fake money only" title="Paper trading simulator">
        Practice placing stock orders with <strong>SIM$100,000 of pretend money</strong> against real market prices.
        Nothing here is a real account, a real broker or real money. You cannot deposit, withdraw or win anything, and no
        order ever reaches a stock exchange.
      </PageTitle>
      <Simulator />
    </>
  );
}
