import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('\n=== Nyander Setup ===\n');

  // 1. Delete old seed data
  console.log('1. Clearing old data...');
  await supabase.from('cats').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('  Done');

  // 2. Create auth users
  console.log('2. Creating auth users...');
  const configs = [
    {
      email: 'shelter.demo@nyander.app',
      password: 'shelter123',
      meta: { display_name: 'Warsaw Foster Network', role: 'centro' },
      profile: { display_name: 'Warsaw Foster Network', role: 'centro', phone: '+48 600 100 200', address: 'ul. Główna 15, Warsaw', score: 92 },
    },
    {
      email: 'adopter.demo@nyander.app',
      password: 'adopter123',
      meta: { display_name: 'Alex Demo', role: 'usuario' },
      profile: { display_name: 'Alex Demo', role: 'usuario', phone: '+48 600 100 201', address: 'ul. Marszałkowska 10, Warsaw', score: 85 },
    },
  ];

  let shelterId;

  for (const c of configs) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: c.email,
      password: c.password,
      email_confirm: true,
      user_metadata: c.meta,
    });

    if (error) {
      console.log(`  ${c.email} already exists, fetching...`);
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === c.email);
      if (existing) {
        const uid = existing.id;
        if (c.profile.role === 'centro') shelterId = uid;
        await supabase.from('profiles').upsert({ id: uid, email: c.email, ...c.profile });
        console.log(`  ✓ Using ${c.email} (${uid})`);
      } else {
        console.error(`  ✗ ${c.email}: ${error.message}`);
      }
      continue;
    }

    console.log(`  ✓ Created ${c.email} (${data.user.id})`);
    if (c.profile.role === 'centro') shelterId = data.user.id;

    await supabase.from('profiles').upsert({
      id: data.user.id,
      email: c.email,
      ...c.profile,
    });
  }

  if (!shelterId) {
    console.error('No shelter user available.');
    process.exit(1);
  }

  // 3. Seed cats
  console.log('3. Seeding cats...');
  const cats = [
    { shelter_id: shelterId, name: 'Luna', age: '2 years', breed: 'Domestic Shorthair', description: 'Gentle, curious, and happiest when she can nap near a sunny window.', location: 'Warsaw Foster Home', latitude: 52.2297, longitude: 21.0122, health_status: 'Vaccinated', image_urls: ['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=900&auto=format&fit=crop'], likes: 34, status: 'available' },
    { shelter_id: shelterId, name: 'Milo', age: '1 year', breed: 'Tabby', description: 'A playful little climber who loves feather toys and confident people.', location: 'City Cat Rescue', latitude: 52.2297, longitude: 21.0122, health_status: 'Neutered', image_urls: ['https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=900&auto=format&fit=crop'], likes: 27, status: 'available' },
    { shelter_id: shelterId, name: 'Nala', age: '4 years', breed: 'Calico', description: 'Independent at first, deeply affectionate once she decides you are her person.', location: 'Northside Shelter', latitude: 52.2297, longitude: 21.0122, health_status: 'Special diet', image_urls: ['https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=900&auto=format&fit=crop'], likes: 41, status: 'available' },
    { shelter_id: shelterId, name: 'Whiskers', age: '3 years', breed: 'Siamese', description: 'Talkative, intelligent, and loves being the center of attention.', location: 'Downtown Cat Alliance', latitude: 52.2370, longitude: 21.0170, health_status: 'Vaccinated & Neutered', image_urls: ['https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?w=900&auto=format&fit=crop'], likes: 19, status: 'available' },
    { shelter_id: shelterId, name: 'Bella', age: '5 years', breed: 'Persian', description: 'A calm lap cat who enjoys quiet afternoons and gentle brushing sessions.', location: 'Persian Paws Rescue', latitude: 52.2150, longitude: 21.0050, health_status: 'Regular checkups', image_urls: ['https://images.unsplash.com/photo-1574158622682-e40e69881006?w=900&auto=format&fit=crop'], likes: 52, status: 'available' },
    { shelter_id: shelterId, name: 'Simba', age: null, breed: 'Orange Tabby', description: 'Kitten full of energy! Loves laser pointers, cardboard boxes, and cuddles after playtime.', location: 'Kitten Rescue Network', latitude: 52.2450, longitude: 21.0300, health_status: 'First shots done', image_urls: ['https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=900&auto=format&fit=crop'], likes: 73, status: 'available' },
  ];

  for (const cat of cats) {
    const { error } = await supabase.from('cats').insert(cat);
    console.log(`  ${error ? '✗' : '✓'} ${cat.name}${error ? ': ' + error.message : ''}`);
  }

  console.log('\n=== Setup complete! ===\n');
  console.log('Login credentials:');
  console.log('  Shelter: shelter.demo@nyander.app / shelter123');
  console.log('  Adopter: adopter.demo@nyander.app / adopter123');
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
