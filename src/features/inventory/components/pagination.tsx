export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * System Design 6.8: navigation is page-based and bounds how many records the
 * client renders. The server remains the authority for the total count.
 */
export function Pagination({ page, pageCount, total, onPageChange }: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Inventory pagination">
      <button
        type="button"
        className="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="pagination__status" data-testid="pagination-status">
        Page {page} of {pageCount}
      </span>
      <span className="pagination__total">{total} vehicles</span>
      <button
        type="button"
        className="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
