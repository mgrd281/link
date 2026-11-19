import LinkyoDesignSystem
import SwiftUI
import WidgetKit

/// Widgets (Phase 2: live stats via App Group + Supabase). Phase 0: target + brand-correct placeholder.
struct StatsEntry: TimelineEntry {
    let date: Date
    let views: Int
    let clicks: Int
}

struct StatsProvider: TimelineProvider {
    func placeholder(in context: Context) -> StatsEntry { StatsEntry(date: .now, views: 2481, clicks: 612) }
    func getSnapshot(in context: Context, completion: @escaping (StatsEntry) -> Void) { completion(placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<StatsEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .after(.now.addingTimeInterval(60 * 60))))
    }
}

struct TodayStatsView: View {
    let entry: StatsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: LinkyoTokens.Spacing.s2) {
            LinkyoSymbol()
                .foregroundStyle(Color.Linkyo.primary)
                .frame(width: LinkyoTokens.Size.iconLg, height: LinkyoTokens.Size.iconLg)
            Spacer(minLength: 0)
            Text(entry.views, format: .number).linkyoText(.h2).monospacedDigit()
            Text("Views today").linkyoText(.caption).foregroundStyle(Color.Linkyo.fgSecondary)
        }
        .containerBackground(Color.Linkyo.surface, for: .widget)
    }
}

struct TodayStatsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TodayStats", provider: StatsProvider()) { entry in
            TodayStatsView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Views and clicks on your page.")
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}

@main
struct LinkyoWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TodayStatsWidget()
    }
}
