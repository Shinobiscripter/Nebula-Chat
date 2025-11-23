import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Chat {
  id: string;
  type: string;
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
  lastMessage?: {
    content: string;
    created_at: string;
  };
  otherUser?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

const ChatList = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all chats the user is a member of
      const { data: chatMembers, error: membersError } = await supabase
        .from('chat_members')
        .select(`
          chat_id,
          chats (
            id,
            type,
            name,
            avatar_url,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (membersError) throw membersError;

      // Get last message for each chat and other user info for DMs
      const chatsWithDetails = await Promise.all(
        (chatMembers || []).map(async (member: any) => {
          const chat = member.chats;
          
          // Get last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          let otherUser = null;
          if (chat.type === 'dm') {
            // Get the other user in the DM
            const { data: otherMember } = await supabase
              .from('chat_members')
              .select(`
                user_id,
                profiles (
                  username,
                  display_name,
                  avatar_url
                )
              `)
              .eq('chat_id', chat.id)
              .neq('user_id', user.id)
              .single();

            if (otherMember) {
              otherUser = otherMember.profiles;
            }
          }

          return {
            ...chat,
            lastMessage,
            otherUser,
          };
        })
      );

      setChats(chatsWithDetails as Chat[]);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === 'group') return chat.name || 'Unnamed Group';
    return chat.otherUser?.display_name || 'Unknown User';
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.type === 'group') return chat.avatar_url;
    return chat.otherUser?.avatar_url;
  };

  const getInitials = (chat: Chat) => {
    const name = getChatName(chat);
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-primary">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-foreground">Chats</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/new-chat')}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MessageSquarePlus className="h-12 w-12 text-muted mb-4" />
            <p className="text-muted-foreground">No chats yet</p>
            <p className="text-sm text-muted-foreground">Start a conversation!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => navigate(`/chat/${chat.id}`)}
                className="w-full p-4 hover:bg-accent transition-colors flex items-center gap-3 text-left"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={getChatAvatar(chat) || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(chat)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate">{getChatName(chat)}</p>
                    {chat.lastMessage && (
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(chat.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  {chat.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ChatList;
