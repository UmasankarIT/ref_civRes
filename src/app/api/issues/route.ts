import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const search = searchParams.get('search')?.toLowerCase();

    let issues = civicStore.getIssues();
    const categories = civicStore.getCategories();

    if (categoryId && categoryId !== 'all') {
      issues = issues.filter((i) => i.categoryId === categoryId || i.category.code === categoryId);
    }

    if (status && status !== 'all') {
      issues = issues.filter((i) => i.status === status);
    }

    if (department && department !== 'all') {
      issues = issues.filter((i) => i.category.responsibleDepartment.toLowerCase().includes(department.toLowerCase()));
    }

    if (search) {
      issues = issues.filter(
        (i) =>
          i.title.toLowerCase().includes(search) ||
          i.description.toLowerCase().includes(search) ||
          i.formattedAddress.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      issues,
      categories,
      totalCount: issues.length,
    });
  } catch (error: unknown) {
    console.error('Error querying issues:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error querying issues.' },
      { status: 500 }
    );
  }
}
