
import { createClient } from '@supabase/supabase-js';
import { MushroomRoom, Participant } from '../types';

const SUPABASE_URL = 'https://wofbnytcwqwdwobgfero.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_k5gIYJGuLFmzedAEV6INRA_lhKScMtq'; 

// 在生產環境中，這個 Client 應該只建立一次
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

export const syncRoomToGlobal = async (room: MushroomRoom): Promise<boolean> => {
  try {
    const payload = {
      id: room.id,
      host_nickname: room.host.nickname,
      host_friend_code: room.host.friendCode,
      category: room.category,
      attribute: room.attribute,
      slots: room.slots,
      image_url: room.imageUrl,
      participants: room.participants,
      start_time: room.startTime,
      created_at: room.createdAt,
      status: room.status,
      min_strength: room.minStrength
    };

    const { error } = await supabase
      .from('mushroom_rooms')
      .upsert(payload, { onConflict: 'id' });
    
    if (error) console.error("Sync Error:", error.message);
    return !error;
  } catch (e) {
    return false;
  }
};

export const joinRoomGlobal = async (roomId: string, participant: Participant): Promise<boolean> => {
  try {
    // 呼叫我們在 SQL Editor 建立的 RPC 函式
    const { data, error } = await supabase.rpc('join_mushroom_room', {
      target_room_id: roomId,
      new_participant: participant
    });
    
    if (error) {
      console.error("Join Error:", error.message);
      return false;
    }
    return data as boolean;
  } catch (e) {
    return false;
  }
};

export const leaveRoomGlobal = async (roomId: string, friendCode: string): Promise<boolean> => {
  try {
    const { data: currentData, error: fetchError } = await supabase
      .from('mushroom_rooms')
      .select('participants')
      .eq('id', roomId)
      .single();
      
    if (fetchError || !currentData) return false;
    
    const updatedParticipants = (currentData.participants || []).filter((p: Participant) => p.friendCode !== friendCode);
    
    const { error: updateError } = await supabase
      .from('mushroom_rooms')
      .update({ participants: updatedParticipants })
      .eq('id', roomId);
      
    return !updateError;
  } catch (e) {
    return false;
  }
};

export const deleteRoomGlobal = async (roomId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('mushroom_rooms')
      .delete()
      .eq('id', roomId);
    return !error;
  } catch (e) {
    return false;
  }
};

export const fetchGlobalRooms = async (): Promise<MushroomRoom[]> => {
  try {
    const { data, error } = await supabase
      .from('mushroom_rooms')
      .select('*')
      .eq('status', 'active')
      // 只抓取 24 小時內的貼文 (生產環境邏輯)
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(item => ({
      id: item.id,
      host: { id: 'remote', nickname: item.host_nickname, friendCode: item.host_friend_code },
      category: item.category,
      attribute: item.attribute,
      slots: item.slots,
      imageUrl: item.image_url,
      participants: item.participants || [],
      startTime: item.start_time,
      createdAt: item.created_at,
      status: item.status,
      minStrength: item.min_strength
    }));
  } catch (e) {
    return [];
  }
};
