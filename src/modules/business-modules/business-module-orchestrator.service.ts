import type { Company, Conversation } from "@prisma/client";
import { handleRestaurantOrderModule } from "./restaurant-orders.service";

export async function handleBusinessModules(input: {
  company: Company;
  conversation: Conversation;
  customerMessage: string;
}) {
  const restaurantOrderResult = await handleRestaurantOrderModule(input);
  if (restaurantOrderResult.handled) return restaurantOrderResult;

  return { handled: false };
}
