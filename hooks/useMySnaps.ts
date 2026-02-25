import { useState, useEffect, useRef } from 'react';
import { getUserSnaps } from '../utils/getUserSnaps';

interface LastPostInfo {
  author: string;
  permlink: string;
}

export function useMySnaps(username: string | null) {
  const lastPostRef = useRef<LastPostInfo | null>(null);
  const fetchedPermlinksRef = useRef<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Fetch more snaps with progressive loading
  async function getMoreSnaps(): Promise<any[]> {
    if (!username || username === 'SPECTATOR') {
      return [];
    }

    const pageSize = 10;
    const allFilteredSnaps: any[] = [];
    let hasMoreData = true;
    let iterationCount = 0;
    const maxIterations = 10; // Prevent infinite loops
    
    // Track all permlinks to avoid duplicates
    const allPermlinks = new Set(fetchedPermlinksRef.current);

    while (allFilteredSnaps.length < pageSize && hasMoreData && iterationCount < maxIterations) {
      iterationCount++;
      
      try {
        const result = await getUserSnaps(
          username,
          'comments',
          20, // Fetch more at once to improve efficiency
          lastPostRef.current?.author,
          lastPostRef.current?.permlink
        );

        if (!result.length) {
          hasMoreData = false;
          break;
        }

        // Remove duplicates (getUserSnaps already filters for parent_author)
        const uniqueSnaps = result.filter(snap => !allPermlinks.has(snap.permlink));
        
        // Add to results and track permlinks
        uniqueSnaps.forEach(snap => {
          allPermlinks.add(snap.permlink);
          allFilteredSnaps.push(snap);
        });

        // Update pagination info using the last item from the original result
        if (result.length > 0) {
          const lastItem = result[result.length - 1];
          lastPostRef.current = {
            author: lastItem.author,
            permlink: lastItem.permlink
          };
        }

        // If we got fewer results than requested, we've reached the end
        if (result.length < 20) {
          hasMoreData = false;
        }

      } catch (error) {
        console.error('[useMySnaps] Error fetching user snaps:', error);
        hasMoreData = false;
      }
    }

    // Update the ref with all permlinks seen so far
    fetchedPermlinksRef.current = allPermlinks;

    // Sort by created date descending
    allFilteredSnaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    
    return allFilteredSnaps;
  }

  // Reset when username changes
  useEffect(() => {
    if (username && username !== 'SPECTATOR') {
      lastPostRef.current = null;
      fetchedPermlinksRef.current = new Set();
      setSnaps([]);
      setCurrentPage(1);
      setHasMore(true);
    }
  }, [username]);

  // Fetch snaps when currentPage changes
  useEffect(() => {
    if (!username || username === 'SPECTATOR') {
      setSnaps([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }

    const fetchSnaps = async () => {
      setIsLoading(true);
      try {
        const newSnaps = await getMoreSnaps();
        setSnaps((prevSnaps) => {
          const existingPermlinks = new Set(prevSnaps.map((snap) => snap.permlink));
          const uniqueSnaps = newSnaps.filter((snap: any) => !existingPermlinks.has(snap.permlink));
          
          // If no new unique snaps, set hasMore to false
          if (uniqueSnaps.length === 0) {
            setHasMore(false);
          }
          
          return [...prevSnaps, ...uniqueSnaps];
        });
      } catch (err) {
        console.error('[useMySnaps] Error in fetchSnaps:', err);
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSnaps();
  }, [currentPage, username]);

  // Load the next page
  const loadNextPage = () => {
    if (!isLoading && hasMore && username && username !== 'SPECTATOR') {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  // Refresh function to reset and reload
  const refresh = () => {
    console.log('[useMySnaps] REFRESH CALLED - this will reset feed to top');
    if (username && username !== 'SPECTATOR') {
      lastPostRef.current = null;
      fetchedPermlinksRef.current = new Set();
      setSnaps([]);
      setCurrentPage(1);
      setHasMore(true);
    }
  };

  return { 
    snaps, 
    isLoading, 
    loadNextPage, 
    hasMore, 
    currentPage,
    refresh 
  };
}
