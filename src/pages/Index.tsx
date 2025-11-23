import { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import ChatList from '@/components/ChatList';
import ChatScreen from '@/components/ChatScreen';
import NewChat from '@/components/NewChat';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show new chat screen
  if (location.pathname === '/new-chat') {
    return <NewChat />;
  }

  // Show chat screen
  if (chatId) {
    return <ChatScreen />;
  }

  // Show chat list
  return (
    <div className="flex flex-col h-screen bg-background">
      <ChatList />
      <div className="p-4 border-t border-border bg-card">
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Index;
