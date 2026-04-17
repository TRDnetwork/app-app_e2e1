let channels = [];

export async function setupRealtime(supabase, onChange) {
  // Clean up any existing channels
  teardownRealtime();

  // Subscribe to workouts table
  const workoutChannel = supabase
    .channel('workouts-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_e2e1_workouts',
        filter: `user_id=eq.${(await supabase.auth.getUser()).data.user.id}`
      },
      (payload) => {
        console.log('Workout change received', payload);
        onChange(payload);
      }
    )
    .subscribe();

  channels.push(workoutChannel);

  // Subscribe to profiles if needed (e.g., for avatar/name updates)
  const profileChannel = supabase
    .channel('profiles-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_e2e1_profiles',
        filter: `user_id=eq.${(await supabase.auth.getUser()).data.user.id}`
      },
      (payload) => {
        console.log('Profile change received', payload);
        onChange(payload);
      }
    )
    .subscribe();

  channels.push(profileChannel);
}

export function teardownRealtime() {
  channels.forEach(channel => {
    channel.unsubscribe();
  });
  channels = [];
}