import { useQuery } from '@tanstack/react-query';
import { DEFAULT_DISCORD_LINK, fetchAppSettings } from '@/lib/usernameStore';

export const useDiscordLink = () => {
  const { data } = useQuery({
    queryKey: ['appSettings'],
    queryFn: fetchAppSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchInterval: 60000,
  });

  return data?.discordServerLink || DEFAULT_DISCORD_LINK;
};
