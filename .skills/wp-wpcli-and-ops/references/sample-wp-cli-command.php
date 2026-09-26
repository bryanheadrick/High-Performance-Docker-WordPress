<?php
/**
 * Sample WP-CLI command fixture for review and adaptation.
 *
 * @package PrefixPlugin
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

/**
 * Prime report caches in controlled batches.
 */
class Prefix_Report_Cache_Prime_Command extends WP_CLI_Command {

	/**
	 * Prime report caches.
	 *
	 * ## OPTIONS
	 *
	 * [--batch-size=<number>]
	 * : Number of posts to process per batch.
	 *
	 * [--dry-run]
	 * : Preview the work without writing cache entries.
	 *
	 * ## EXAMPLES
	 *
	 *     wp prefix report-cache-prime --batch-size=50 --dry-run
	 *     wp prefix report-cache-prime --batch-size=100
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Associative arguments.
	 */
	public function __invoke( $args, $assoc_args ) {
		$batch_size = isset( $assoc_args['batch-size'] ) ? absint( $assoc_args['batch-size'] ) : 100;
		$dry_run    = isset( $assoc_args['dry-run'] );
		$paged      = 1;
		$total      = 0;

		if ( $batch_size < 1 ) {
			WP_CLI::error( 'Batch size must be greater than zero.' );
		}

		WP_CLI::log(
			sprintf(
				'Starting cache prime. Batch size: %d. Dry run: %s.',
				$batch_size,
				$dry_run ? 'yes' : 'no'
			)
		);

		do {
			$query = new WP_Query(
				array(
					'post_type'      => 'post',
					'post_status'    => 'publish',
					'posts_per_page' => $batch_size,
					'paged'          => $paged,
					'fields'         => 'ids',
					'no_found_rows'  => true,
				)
			);

			if ( empty( $query->posts ) ) {
				break;
			}

			foreach ( $query->posts as $post_id ) {
				if ( $dry_run ) {
					WP_CLI::log( sprintf( '[dry-run] Would prime report cache for post %d.', $post_id ) );
					continue;
				}

				wp_cache_set(
					sprintf( 'prefix_report_%d', $post_id ),
					array(
						'post_id'    => $post_id,
						'generated'  => time(),
						'is_preview' => false,
					),
					'prefix_reports',
					HOUR_IN_SECONDS
				);

				$total++;
			}

			WP_CLI::log( sprintf( 'Processed page %d.', $paged ) );
			$paged++;
		} while ( true );

		if ( $dry_run ) {
			WP_CLI::success( 'Dry run complete.' );
			return;
		}

		WP_CLI::success( sprintf( 'Primed %d report cache entries.', $total ) );
	}
}

WP_CLI::add_command( 'prefix report-cache-prime', 'Prefix_Report_Cache_Prime_Command' );
