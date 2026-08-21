import SeatMap2D from "@/components/SeatMap2D";
import { ALL_SEATS, HALL_DEPTH, HALL_WIDTH, TABLES, TOTAL_SEATS } from "@/shared/venue";

export function VenueRoute() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl">Venue geometry</h1>
      <p className="mt-2 text-sm text-muted">{TOTAL_SEATS} seats · {TABLES.length} tables · hall {HALL_WIDTH} × {HALL_DEPTH} m.</p>
      <div className="mt-8 overflow-x-auto"><SeatMap2D className="min-w-[46rem] w-full" showRoute focus={{ tableId: 8, seatIndex: 5 }} highlight={[{ tableId: 8, seatIndex: 4 }, { tableId: 8, seatIndex: 5 }, { tableId: 8, seatIndex: 6 }]} /></div>
      <table className="mt-10 w-full border-collapse text-sm">
        <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-medium">Table</th><th className="py-2 font-medium">Shape</th><th className="py-2 font-medium">Seats</th><th className="py-2 font-medium">Centre (x, z)</th></tr></thead>
        <tbody>
          {TABLES.map((table) => <tr key={table.id} className="border-b border-line/60"><td className="py-2">{table.id}</td><td className="py-2 text-muted">{table.shape}</td><td className="py-2">{table.seats}</td><td className="py-2 text-muted">{table.center.x.toFixed(2)}, {table.center.z.toFixed(2)}</td></tr>)}
          <tr><td className="py-2 font-medium">Total</td><td /><td className="py-2 font-medium">{ALL_SEATS.length}</td><td /></tr>
        </tbody>
      </table>
    </main>
  );
}
