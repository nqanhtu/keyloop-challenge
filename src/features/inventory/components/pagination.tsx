import { Button } from '../../../app/ui';
import { PAGE_SIZE_OPTIONS } from '../search';

export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * System Design 6.8 / Decision 0004: navigation is page-based and bounds how
 * many records the client renders. The server remains the authority for the
 * total count. The page-size control lives inside the pagination region so it
 * does not become an extra tab stop before the toolbar controls, and it is a
 * view control rather than a filter constraint (UI System Design §13.3).
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Inventory pagination">
      <div className="pagination__summary">
        <span className="pagination__status" data-testid="pagination-status">
          Page {page} of {pageCount}
        </span>
        <span className="pagination__total">{total} vehicles</span>
      </div>
      <div className="pagination__size">
        <label htmlFor="inventory-page-size">Rows per page</label>
        <select
          id="inventory-page-size"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div className="pagination__actions">
        <Button
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
