import type { PageServerLoad } from "./$types";
import { loadUnitCategory } from "$lib/server/category-load";
export const load: PageServerLoad = ({ url }) => loadUnitCategory(url, "Creature");
