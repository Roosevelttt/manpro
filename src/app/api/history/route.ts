import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - fetch user search history
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // get query params for pagination
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // fetch history with pagination
    const [history, total] = await Promise.all([
      prisma.searchHistory.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: {
          searchedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.searchHistory.count({
        where: {
          userId: session.user.id,
        },
      }),
    ]);

    // parse artists json string back to array
    const formattedHistory = history.map(item => ({
      ...item,
      artists: JSON.parse(item.artists),
    }));

    return NextResponse.json({
      history: formattedHistory,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'History ID is required' },
        { status: 400 }
      );
    }

    // verify history item belongs to user
    const historyItem = await prisma.searchHistory.findUnique({
      where: { id },
    });

    if (!historyItem) {
      return NextResponse.json(
        { error: 'History item not found' },
        { status: 404 }
      );
    }

    if (historyItem.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // delete
    await prisma.searchHistory.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'History item deleted' });
  } catch (error) {
    console.error('History delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}