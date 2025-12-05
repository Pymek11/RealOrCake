#!/usr/bin/env python3
"""Query ./data/db.sqlite ratings table and plot count(rating) grouped by video_id.

Saves plot to ./data/rating_counts.png by default. Uses matplotlib (Agg backend)
so it works on headless machines.
"""
import sqlite3
import argparse
import os
import sys

def main():
    parser = argparse.ArgumentParser(description='Plot count(rating) grouped by video_id from SQLite DB')
    parser.add_argument('--db', '-d', default='./data/db.sqlite', help='Path to sqlite DB (default: ./data/db.sqlite)')
    parser.add_argument('--out', '-o', default='./data/rating_counts.png', help='Output PNG path')
    parser.add_argument('--top', '-t', type=int, default=20, help='Show only top N videos by count (0 = all). Default: 20')
    parser.add_argument('--stacked', action='store_true', help='Produce a single stacked bar chart instead of the default per-video grid.')
    parser.add_argument('--show', action='store_true', help='Try to open the generated image after saving (platform-specific)')
    args = parser.parse_args()

    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except Exception as e:
        print('matplotlib is required to run this script. Install with: pip install matplotlib')
        print('Error:', e)
        sys.exit(1)

    if not os.path.exists(args.db):
        print('DB not found at', args.db)
        sys.exit(1)

    conn = sqlite3.connect(args.db)
    cur = conn.cursor()
    try:
        # Get counts grouped by video_id and rating
        cur.execute("SELECT video_id, rating, COUNT(*) as cnt FROM ratings GROUP BY video_id, rating")
        rows = cur.fetchall()
    except Exception as e:
        print('Query failed:', e)
        conn.close()
        sys.exit(1)
    conn.close()

    if not rows:
        print('No rows returned from query.')
        sys.exit(0)

    # Aggregate into dict: video_id -> {rating: count}
    from collections import defaultdict
    agg = defaultdict(lambda: defaultdict(int))
    for vid, rating, cnt in rows:
        key = vid or ''
        # normalize rating to string, handle nulls
        rkey = str(rating) if rating is not None else 'NA'
        agg[key][rkey] += cnt

    # compute total counts per video and sort by total desc
    totals = [(v, sum(agg[v].values())) for v in agg]
    totals.sort(key=lambda x: x[1], reverse=True)

    if args.top and args.top > 0:
        totals = totals[: args.top]

    videos_sorted = [t[0] for t in totals]

    rating_keys = ['1', '2', '3', '4', '5']

    # Default behavior: per-video grid. Use --stacked to produce the single stacked plot.
    if not args.stacked:
        # Create grid of subplots, one per video, showing distribution of ratings (1..5)
        n = len(videos_sorted)
        if n == 0:
            print('No videos to plot.')
            sys.exit(0)
        cols = 5
        rows = (n + cols - 1) // cols
        fig_w = cols * 3
        fig_h = rows * 2.5
        fig, axes = plt.subplots(rows, cols, figsize=(fig_w, fig_h), squeeze=False)

        # compute global max for consistent y-axis
        all_max = 0
        vals_by_vid = []
        for vid in videos_sorted:
            vals = [agg[vid].get(k, 0) for k in rating_keys]
            vals_by_vid.append(vals)
            all_max = max(all_max, max(vals) if vals else 0)

        x_positions = [1, 2, 3, 4, 5]
        for idx, vid in enumerate(videos_sorted):
            r = idx // cols
            c = idx % cols
            ax = axes[r][c]
            vals = vals_by_vid[idx]
            bars = ax.bar(x_positions, vals, color=['#d62728', '#ff7f0e', '#2ca02c', '#1f77b4', '#9467bd'], width=0.6)
            # annotate counts on bars
            for bar in bars:
                h = bar.get_height()
                if h > 0:
                    ax.text(bar.get_x() + bar.get_width()/2, h + max(0.1, all_max*0.02), str(int(h)), ha='center', va='bottom', fontsize=8)
            ax.set_title(os.path.basename(vid), fontsize=9)
            ax.set_ylim(0, max(1, int(all_max * 1.2)))
            ax.set_xticks(x_positions)
            ax.set_xticklabels(rating_keys)
            ax.set_xlabel('Rating')
            ax.set_ylabel('Count')

        # hide unused subplots
        total_slots = rows * cols
        for idx in range(n, total_slots):
            r = idx // cols
            c = idx % cols
            axes[r][c].axis('off')

        plt.suptitle('Per-video rating distributions (ratings 1..5)')
        plt.tight_layout(rect=[0, 0.03, 1, 0.95])
        out_dir = os.path.dirname(args.out) or '.'
        os.makedirs(out_dir, exist_ok=True)
        plt.savefig(args.out)
        print('Saved per-video grid plot to', args.out)
    else:
        # Prepare matrix for ratings 1..5 (as strings)
        data_matrix = []
        for r in rating_keys:
            row_vals = [agg[v].get(r, 0) for v in videos_sorted]
            data_matrix.append(row_vals)

        # labels (shortened basenames)
        labels = [os.path.basename(v) for v in videos_sorted]

        # plotting stacked bar chart
        width = max(8, min(40, max(3, len(labels) * 0.5)))
        plt.figure(figsize=(width, 6))
        x = range(len(labels))
        bottoms = [0] * len(labels)
        colors = ['#d62728', '#ff7f0e', '#2ca02c', '#1f77b4', '#9467bd']
        for i, r in enumerate(rating_keys):
            vals = data_matrix[i]
            plt.bar(x, vals, bottom=bottoms, color=colors[i % len(colors)], label=f'Rating {r}')
            bottoms = [bottoms[j] + vals[j] for j in range(len(vals))]

        plt.xticks(x, labels, rotation=45, ha='right')
        plt.ylabel('Count of ratings')
        plt.title('Ratings count per video (stacked by rating 1–5)')
        plt.legend(title='Ratings')
        plt.tight_layout()

        out_dir = os.path.dirname(args.out) or '.'
        os.makedirs(out_dir, exist_ok=True)
        plt.savefig(args.out)
        print('Saved plot to', args.out)

    if args.show:
        try:
            if os.name == 'nt':
                os.startfile(os.path.abspath(args.out))
            else:
                # try common unix openers
                import subprocess
                opener = None
                for cmd in ('xdg-open', 'open'):
                    if subprocess.call(['which', cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
                        opener = cmd
                        break
                if opener:
                    subprocess.Popen([opener, args.out])
        except Exception as e:
            print('Failed to open image automatically:', e)

if __name__ == '__main__':
    main()
