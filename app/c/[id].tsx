import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ShortLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { if (id) router.replace(`/cat/${id}`); }, [id]);
  return null;
}
