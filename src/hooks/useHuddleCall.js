import { useHuddleMediaService } from "../huddle/media/HuddleMediaService";

export function useHuddleCall({ currentUser }) {
  return useHuddleMediaService({ currentUser });
}
