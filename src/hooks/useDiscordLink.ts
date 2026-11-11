import { useQuery } from '@tanstack/react-query';
import { DEFAULT_DISCORD_LINK, fetchAppSettings } from '@/lib/usernameStore';

export const useDiscordLink = () => {
  const { data } = useQuery({
    queryKey: ['appSettings'],
    queryFn: fetchAppSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchInterval: 60000,
  });

  const rawLink = data?.discordServerLink || DEFAULT_DISCORD_LINK;
  
  // Security validation: Only allow legitimate https:// URLs to prevent javascript: or malformed URI execution
  if (!/^https?:\/\//i.test(rawLink.trim())) {
    return DEFAULT_DISCORD_LINK;
  }

  return rawLink.trim();
};
