import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://chfxzyyxellkdyvwgplw.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function seed() {
  console.log('Seeding database...');

  // Create demo shelter profiles
  const { data: shelter, error: shelterError } = await supabase
    .from('profiles')
    .insert({
      id: 'demo-shelter-1',
      email: 'demo-shelter@example.com',
      role: 'centro',
      display_name: 'Warsaw Foster Network',
      address: 'Warsaw, Poland',
      latitude: '52.2297',
      longitude: '21.0122',
      score: 100,
    })
    .select()
    .single();

  if (shelterError && !shelterError.message.includes('duplicate key')) {
    console.error('Error creating shelter:', shelterError);
  } else if (shelter) {
    console.log('Created shelter:', shelter.display_name);
  } else {
    console.log('Shelter already exists');
  }

  // Create demo cats
  const demoCats = [
    {
      id: 'demo-luna',
      name: 'Luna',
      age: '2 years',
      breed: 'Domestic Shorthair',
      description: 'Gentle, curious, and happiest when she can nap near a sunny window.',
      location: 'Warsaw Foster Home',
      latitude: '52.2297',
      longitude: '21.0122',
      health_status: 'Vaccinated',
      image_urls: ['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=900&auto=format&fit=crop'],
      likes: 34,
      status: 'available',
      shelter_id: 'demo-shelter-1',
    },
    {
      id: 'demo-milo',
      name: 'Milo',
      age: '1 year',
      breed: 'Tabby',
      description: 'A playful little climber who loves feather toys and confident people.',
      location: 'City Cat Rescue',
      latitude: '52.2297',
      longitude: '21.0122',
      health_status: 'Neutered',
      image_urls: ['https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=900&auto=format&fit=crop'],
      likes: 27,
      status: 'available',
      shelter_id: 'demo-shelter-1',
    },
    {
      id: 'demo-nala',
      name: 'Nala',
      age: '4 years',
      breed: 'Calico',
      description: 'Independent at first, deeply affectionate once she decides you are her person.',
      location: 'Northside Shelter',
      latitude: '52.2297',
      longitude: '21.0122',
      health_status: 'Special diet',
      image_urls: ['https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=900&auto=format&fit=crop'],
      likes: 41,
      status: 'available',
      shelter_id: 'demo-shelter-1',
    },
  ];

  for (const cat of demoCats) {
    const { error } = await supabase.from('cats').insert(cat);
    if (error && !error.message.includes('duplicate key')) {
      console.error(`Error creating cat ${cat.name}:`, error);
    } else {
      console.log(`Created cat: ${cat.name}`);
    }
  }

  console.log('Seeding complete!');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
