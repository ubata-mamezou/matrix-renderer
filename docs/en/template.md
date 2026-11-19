# YAML Configuration Template

The following example shows how to configure a matrix.

```yaml
title: Example matrix # Optional matrix title
width: 800 # Optional matrix width (default: 1400)
lineColor: "#8798a8" # Optional grid line color (default: #d7e0e8)
xAxis: # X-axis configuration (columns)
  label: Columns # X-axis heading
  values: # Column definitions
    - label: Column 1 # Column label
      color: "#d6eaf8" # Optional column color (#RGB or #RRGGBB)
    - Column 2 # Column label without a color
    - label: Column 3 # Column label without a color, using an explicit key
    - label: Column 4
      color: "#d6ea00"
      sub-labels: # Nested column labels
        - Column 4.1
        - label: Column 4.2
          sub-labels:
            - Column 4.2.1
            - Column 4.2.2
yAxis: # Y-axis configuration (rows)
  label: Rows # Y-axis heading
  values: # Row definitions
    - label: Row 1 # Row label
      color: "#c5e4ec" # Optional row color (#RGB or #RRGGBB)
    - Row 2 # Row label without a color
    - label: Row 3 # Row label without a color, using an explicit key
    - label: Row 4
      color: "#d6ea00"
      sub-labels: # Nested row labels
        - Row 4.1
        - label: Row 4.2
          sub-labels:
            - Row 4.2.1
            - Row 4.2.2
items: # Items to plot
  - id: item1 # Item ID
    label: Item 1 # Item label
    lane: Row 1 # Row to place the item in (a Y-axis label)
    from: Column 1 # Starting column (an X-axis label)
    to: Column 1 # Ending column (an X-axis label)
    url: https://example.com/guide # Optional item link
    color: "#245080" # Optional item color (#RGB or #RRGGBB)
  - id: item2
    label: Item 2
    lane: Row 1
    from: Column 2
    to: Column 2
    before-item: item1 # Optional: place item2 to the right of item1
```

## Field Reference

| Field | Required | Constraints | Default | Description |
|---|---|---|---|---|
| `title` | No | - | `no title` | Matrix title. |
| `width` | No | 700 to 4000 | 1400 | Output image width. |
| `lineColor` | No | `#RGB` or `#RRGGBB` | `#d7e0e8` | Color of grid lines and axis heading boundaries. |
| `xAxis.label` | Yes | - | - | X-axis heading. The X-axis represents the matrix columns. |
| `xAxis.values` | Yes | Non-empty array | - | Column definitions, rendered from left to right in YAML order. |
| `xAxis.values[n].label` | Yes | Unique within the X-axis | - | Column label. |
| `xAxis.values[n].color` | No | `#RGB` or `#RRGGBB` | - | Column color. |
| `xAxis.values[n].sub-labels` | No | Up to three levels, including the root | - | Nested column labels. An empty array is treated as omitted. |
| `yAxis.label` | Yes | Unique within the Y-axis | - | Y-axis heading. The Y-axis represents the matrix rows. |
| `yAxis.values` | Yes | Non-empty array | - | Row definitions, rendered from top to bottom in YAML order. |
| `yAxis.values[n].label` | Yes | Unique within the Y-axis | - | Row label. |
| `yAxis.values[n].color` | No | `#RGB` or `#RRGGBB` | - | Row color. |
| `yAxis.values[n].sub-labels` | No | Up to three levels, including the root | - | Nested row labels. An empty array is treated as omitted. |
| `items` | Yes | Non-empty array | - | Array of items to plot. |
| `items[n].id` | Yes | Unique among items | - | Item identifier. |
| `items[n].label` | Yes | - | - | Text displayed in the item bar. Long labels wrap onto multiple lines. |
| `items[n].lane` | Yes | Must match a Y-axis leaf label | - | Row where the item is placed. |
| `items[n].from` | Yes | Must match an X-axis leaf label | - | Start of the item's column range. |
| `items[n].to` | Yes | Must match an X-axis leaf label at or to the right of `from` | - | End of the item's column range. |
| `items[n].url` | No | HTTP or HTTPS URL | - | Link that opens in a new tab when clicked (SVG only). |
| `items[n].color` | No | `#RGB` or `#RRGGBB` | - | Fill color of the item bar. |
| `items[n].before-item` | No | ID of an item to the left of the current item | - | Defines the order between items. |

* X-axis
  * Rendering order: Columns are drawn in the order defined in `xAxis.values`.
  * Width:
    * All leaf columns have the same width.
    * Parent labels span the combined width of their descendant columns.
* Y-axis
  * Rendering order: Rows are drawn in the order defined in `yAxis.values`.
  * Height:
    * Each row's height depends on the number of items in the row and how their labels wrap.
    * Parent labels span the combined height of their descendant rows.
* Grid line color (`lineColor`)
  * Applies to grid lines and axis heading boundaries.
  * Does not affect item bar borders, which are determined by each item's color.
* Axis colors (`xAxis.values[n].color`, `yAxis.values[n].color`)
  * If a label has its own color, that color is used.
  * Otherwise, the label inherits the color from the nearest ancestor that specifies one.
* Nested labels (`xAxis.values[n].sub-labels`, `yAxis.values[n].sub-labels`)
  * Like root labels, child labels can specify `label`, `color`, and `sub-labels`.
* Item ordering (`items[n].before-item`)
  * The referenced item must exist.
  * It must be in the same row.
  * Its X-axis range must not overlap the current item's range.
  * It must be to the left of the current item.
  * Multiple items cannot reference the same item. For example, `item2` and `item3` cannot both reference `item1`.
  * References can form a chain. For example, `item2` can reference `item1`, and `item3` can reference `item2`.
* Item placement
  * Items linked by `before-item` are placed on the same track.
  * Items without an ordering relationship are automatically placed in available space.
