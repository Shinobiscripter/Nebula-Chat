import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Search, Users, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

const NewChat = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', user.id)
        .limit(20);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDM = async (otherUser: Profile) => {
    setCreatingChat(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if DM already exists
      const { data: existingChats } = await supabase
        .from('chat_members')
        .select(`
          chat_id,
          chats!inner (
            id,
            type
          )
        `)
        .eq('user_id', user.id);

      for (const member of existingChats || []) {
        if (member.chats.type === 'dm') {
          const { data: otherMembers } = await supabase
            .from('chat_members')
            .select('user_id')
            .eq('chat_id', member.chat_id)
            .neq('user_id', user.id);

          if (otherMembers?.length === 1 && otherMembers[0].user_id === otherUser.id) {
            navigate(`/chat/${member.chat_id}`);
            return;
          }
        }
      }

      // Create new DM
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          type: 'dm',
          created_by: user.id,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add both users as members
      const { error: membersError } = await supabase
        .from('chat_members')
        .insert([
          { chat_id: newChat.id, user_id: user.id },
          { chat_id: newChat.id, user_id: otherUser.id },
        ]);

      if (membersError) throw membersError;

      navigate(`/chat/${newChat.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreatingChat(false);
    }
  };

  const createGroup = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one user',
        variant: 'destructive',
      });
      return;
    }

    setCreatingChat(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create group chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          type: 'group',
          name: groupName || 'New Group',
          created_by: user.id,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add all members
      const members = [
        { chat_id: newChat.id, user_id: user.id },
        ...selectedUsers.map(u => ({ chat_id: newChat.id, user_id: u.id })),
      ];

      const { error: membersError } = await supabase
        .from('chat_members')
        .insert(members);

      if (membersError) throw membersError;

      navigate(`/chat/${newChat.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreatingChat(false);
    }
  };

  const toggleUserSelection = (user: Profile) => {
    setSelectedUsers(prev =>
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="p-4 border-b border-border bg-primary">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-primary-foreground">New Chat</h1>
        </div>
      </div>

      <Tabs defaultValue="dm" className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="dm" className="flex-1">Direct Message</TabsTrigger>
          <TabsTrigger value="group" className="flex-1">
            <Users className="h-4 w-4 mr-2" />
            Group Chat
          </TabsTrigger>
        </TabsList>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value="dm" className="flex-1 m-0">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center p-8">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No users found' : 'Search for users to start chatting'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => createDM(user)}
                    disabled={creatingChat}
                    className="w-full p-4 hover:bg-accent transition-colors flex items-center gap-3 text-left disabled:opacity-50"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{user.display_name}</p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="group" className="flex-1 m-0 flex flex-col">
          <div className="p-4 border-b border-border">
            <Input
              placeholder="Group name (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center p-8">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No users found' : 'Search for users to add to the group'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <Checkbox
                      checked={selectedUsers.some(u => u.id === user.id)}
                      onCheckedChange={() => toggleUserSelection(user)}
                    />
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{user.display_name}</p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t border-border">
            <Button
              onClick={createGroup}
              disabled={selectedUsers.length === 0 || creatingChat}
              className="w-full"
            >
              {creatingChat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Group ({selectedUsers.length})
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NewChat;
