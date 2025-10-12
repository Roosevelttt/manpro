import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface SelectedSearchHistory {
  artists: string;
  searchedAt: Date;
}

// GET - history stats
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // fetch ALL history for this user
    const history: SelectedSearchHistory[] = await prisma.searchHistory.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        artists: true,
        searchedAt: true,
      },
    });

    // calculate stats
    const totalSongs = history.length;

    // most searched artists
    const artistCounts: { [key: string]: number } = {};
    history.forEach((item: SelectedSearchHistory) => {
      const artists = JSON.parse(item.artists);
      artists.forEach((artist: string) => {
        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      });
    });

    const topArtists = Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([artist, count]) => ({ artist, count }));

    // weekly songs
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = history.filter(
      (item: SelectedSearchHistory) => new Date(item.searchedAt) >= oneWeekAgo
    ).length;

    // monthly songs
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const thisMonth = history.filter(
      (item: SelectedSearchHistory) => new Date(item.searchedAt) >= oneMonthAgo
    ).length;

    // first search date
    const firstSearch = history.length > 0
      ? history.reduce((earliest: Date, item: SelectedSearchHistory) => {
          const date = new Date(item.searchedAt);
          return date < earliest ? date : earliest;
        }, new Date(history[0].searchedAt))
      : null;

    return NextResponse.json({
      totalSongs,
      topArtists,
      thisWeek,
      thisMonth,
      firstSearch,
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}