import data from "../../data/bookings.json";
import type { BookingLine } from "./types";

export const bookings: BookingLine[] = data as unknown as BookingLine[];
