/**
 * Fixed values the pager shares across its files.
 */

/** The pager pane's id, which every pane event and call names. */
export const PANE_ID = 'file-pager'

/** The columns between two key hints in a row. */
export const KEY_GAP = 2

/** What a tab in a file is drawn as: a tab's width is the terminal's to choose. */
export const TAB_AS_SPACES = '    '

/** The rows the pane asks for beyond the default inline height. */
export const EXTRA_ROWS = 20

/** The terminal height assumed until a drawing has measured it, as after a reload. */
export const ASSUMED_TERMINAL_ROWS = 48

/** How many lines show above a line asked for as `/view <path>:<line>`. */
export const LINES_ABOVE_TARGET = 5

/** How close together a resize and a lost focus must land to count as one event. */
export const RESIZE_FOCUS_WINDOW_MILLISECONDS = 1500

/** The fewest columns the drawing lays itself out for, however narrow the pane. */
export const MINIMUM_COLUMNS = 20

/**
 * The mark drawn in the gutter beside a highlighted region's lines. The region
 * has no background of its own, so the syntax colours stay readable.
 */
export const REGION_MARK = '┃'

/** The mark drawn in the gutter before the cursor's line number. */
export const CURSOR_MARK = '>'
