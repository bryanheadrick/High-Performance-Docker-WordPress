<?php
/**
 * Plugin Name: wpstack Page Abilities
 * Description: Registers WordPress Abilities (via the Abilities API + MCP Adapter) for creating, updating, and validating block-based pages. Exposes wpstack/create-page, wpstack/update-page, wpstack/get-page, wpstack/validate-blocks.
 * Requires Plugins: mcp-adapter
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

const WPSTACK_ALLOWED_BLOCKS = [
    'core/paragraph',
    'core/heading',
    'core/list',
    'core/list-item',
    'core/image',
    'core/gallery',
    'core/cover',
    'core/columns',
    'core/column',
    'core/group',
    'core/buttons',
    'core/button',
    'core/separator',
    'core/spacer',
    'core/quote',
    'core/details',
    'core/embed',
];

/**
 * Recursively validates parsed block markup against the wpstack rules:
 * - only core blocks from the allowlist (core/html is never allowed)
 * - no inline `style` attributes and no raw hex colors in attrs
 * - full-width groups must carry align:"full"
 *
 * @param array<int, array<string, mixed>> $blocks Result of parse_blocks().
 * @param array<int, string>                $errors Accumulator, passed by reference.
 */
function wpstack_validate_block_list( array $blocks, array &$errors, string $path = '' ): void {
    foreach ( $blocks as $index => $block ) {
        $block_path = $path . '/' . $index;
        $block_name = $block['blockName'] ?? null;

        if ( null === $block_name ) {
            // Freeform/classic HTML between blocks parses with blockName = null; treat as core/html violation.
            if ( trim( $block['innerHTML'] ?? '' ) !== '' ) {
                $errors[] = "Block at {$block_path}: raw HTML outside of a registered block is not allowed.";
            }
            continue;
        }

        if ( 'core/html' === $block_name ) {
            $errors[] = "Block at {$block_path}: core/html is not allowed.";
        } elseif ( ! in_array( $block_name, WPSTACK_ALLOWED_BLOCKS, true ) ) {
            $errors[] = "Block at {$block_path}: '{$block_name}' is not in the allowed block list.";
        }

        $attrs = $block['attrs'] ?? [];

        if ( isset( $attrs['style'] ) && is_array( $attrs['style'] ) ) {
            $style_json = wp_json_encode( $attrs['style'] );
            if ( preg_match( '/#[0-9a-fA-F]{3,8}/', (string) $style_json ) ) {
                $errors[] = "Block at {$block_path}: raw hex color found in attrs.style; use a theme.json palette slug instead.";
            }
        }

        if ( str_contains( $block['innerHTML'] ?? '', ' style="' ) ) {
            $errors[] = "Block at {$block_path}: inline style=\"\" attribute found in markup; use block supports/className instead.";
        }

        if ( 'core/group' === $block_name
            && isset( $attrs['layout']['type'] )
            && 'constrained' !== $attrs['layout']['type']
            && ! empty( $block['innerBlocks'] )
            && ( $attrs['align'] ?? null ) === null
        ) {
            // Non-fatal heuristic: a top-level group with nested content and no explicit align
            // is the most common cause of the "why is my full-width section capped at 700px" bug.
            $errors[] = "Block at {$block_path}: core/group with nested content has no 'align' set — add align:\"full\" if this section should span full width.";
        }

        if ( ! empty( $block['innerBlocks'] ) ) {
            wpstack_validate_block_list( $block['innerBlocks'], $errors, $block_path );
        }
    }
}

/**
 * @return array{valid: bool, errors: array<int, string>, blockCount: int}
 */
function wpstack_validate_block_markup( string $content ): array {
    $blocks = parse_blocks( $content );
    $errors = [];
    wpstack_validate_block_list( $blocks, $errors );

    $reserialized = serialize_blocks( $blocks );
    if ( trim( $reserialized ) === '' && trim( $content ) !== '' ) {
        $errors[] = 'Block markup failed to round-trip through parse_blocks()/serialize_blocks() — check for unclosed or malformed block comments.';
    }

    return [
        'valid'      => empty( $errors ),
        'errors'     => $errors,
        'blockCount' => count( $blocks ),
    ];
}

add_action( 'wp_abilities_api_categories_init', function () {
    wp_register_ability_category( 'wpstack', [
        'label'       => 'wpstack',
        'description' => 'Abilities for managing block-based WordPress pages in this environment.',
    ] );
} );

add_action( 'wp_abilities_api_init', function () {

    wp_register_ability( 'wpstack/validate-blocks', [
        'label'         => 'Validate Block Markup',
        'description'   => 'Validates Gutenberg block markup against wpstack rules: core-block allowlist only (no core/html), no inline styles or raw hex colors, and full-width group sections must set align:"full". Does not write anything.',
        'category'      => 'wpstack',
        'input_schema'  => [
            'type'       => 'object',
            'properties' => [
                'content' => [
                    'type'        => 'string',
                    'description' => 'Serialized Gutenberg block markup to validate.',
                ],
            ],
            'required'   => [ 'content' ],
        ],
        'output_schema' => [
            'type'       => 'object',
            'properties' => [
                'valid'      => [ 'type' => 'boolean' ],
                'errors'     => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ],
                'blockCount' => [ 'type' => 'integer' ],
            ],
            'required'   => [ 'valid', 'errors', 'blockCount' ],
        ],
        'execute_callback'    => function ( $input ) {
            $content = (string) ( $input['content'] ?? '' );
            return wpstack_validate_block_markup( $content );
        },
        'permission_callback' => function () {
            return current_user_can( 'edit_posts' );
        },
        'meta' => [ 'public' => true ],
    ] );

    wp_register_ability( 'wpstack/get-page', [
        'label'         => 'Get Page',
        'description'   => 'Fetches a page by ID or slug, including its raw block markup content.',
        'category'      => 'wpstack',
        'input_schema'  => [
            'type'       => 'object',
            'properties' => [
                'id'   => [ 'type' => 'integer', 'description' => 'Page ID. Takes precedence over slug if both are given.' ],
                'slug' => [ 'type' => 'string' ],
            ],
        ],
        'output_schema' => [
            'type'       => 'object',
            'properties' => [
                'id'      => [ 'type' => 'integer' ],
                'title'   => [ 'type' => 'string' ],
                'slug'    => [ 'type' => 'string' ],
                'status'  => [ 'type' => 'string' ],
                'content' => [ 'type' => 'string' ],
                'link'    => [ 'type' => 'string' ],
            ],
        ],
        'execute_callback'    => function ( $input ) {
            $id = (int) ( $input['id'] ?? 0 );

            if ( $id <= 0 && ! empty( $input['slug'] ) ) {
                $found = get_page_by_path( sanitize_title( (string) $input['slug'] ), OBJECT, 'page' );
                $id    = $found ? $found->ID : 0;
            }

            if ( $id <= 0 ) {
                return new WP_Error( 'wpstack_page_not_found', 'No page found for the given id/slug.' );
            }

            $page = get_post( $id );

            if ( ! $page || 'page' !== $page->post_type ) {
                return new WP_Error( 'wpstack_page_not_found', 'No page found for the given id/slug.' );
            }

            return [
                'id'      => $page->ID,
                'title'   => $page->post_title,
                'slug'    => $page->post_name,
                'status'  => $page->post_status,
                'content' => $page->post_content,
                'link'    => get_permalink( $page ),
            ];
        },
        'permission_callback' => function ( $input ) {
            $id = (int) ( $input['id'] ?? 0 );
            return $id > 0 ? current_user_can( 'edit_post', $id ) : current_user_can( 'edit_posts' );
        },
        'meta' => [ 'public' => true ],
    ] );

    wp_register_ability( 'wpstack/create-page', [
        'label'         => 'Create Page',
        'description'   => 'Creates a new WordPress page from Gutenberg block markup. Content is validated against wpstack block rules before being written; validation failures block creation.',
        'category'      => 'wpstack',
        'input_schema'  => [
            'type'       => 'object',
            'properties' => [
                'title'   => [ 'type' => 'string', 'minLength' => 1 ],
                'slug'    => [ 'type' => 'string', 'description' => 'Optional. Derived from title if omitted.' ],
                'content' => [ 'type' => 'string', 'description' => 'Serialized Gutenberg block markup.' ],
                'status'  => [ 'type' => 'string', 'enum' => [ 'draft', 'publish', 'pending', 'private' ], 'default' => 'draft' ],
            ],
            'required'   => [ 'title', 'content' ],
        ],
        'output_schema' => [
            'type'       => 'object',
            'properties' => [
                'id'     => [ 'type' => 'integer' ],
                'link'   => [ 'type' => 'string' ],
                'status' => [ 'type' => 'string' ],
            ],
        ],
        'execute_callback'    => function ( $input ) {
            $title   = sanitize_text_field( (string) ( $input['title'] ?? '' ) );
            $content = (string) ( $input['content'] ?? '' );
            $status  = (string) ( $input['status'] ?? 'draft' );

            if ( '' === $title ) {
                return new WP_Error( 'wpstack_invalid_input', 'title is required.' );
            }

            $validation = wpstack_validate_block_markup( $content );
            if ( ! $validation['valid'] ) {
                return new WP_Error( 'wpstack_block_validation_failed', 'Block markup failed validation.', $validation['errors'] );
            }

            $postarr = [
                'post_title'   => $title,
                'post_content' => $content,
                'post_status'  => in_array( $status, [ 'draft', 'publish', 'pending', 'private' ], true ) ? $status : 'draft',
                'post_type'    => 'page',
            ];

            if ( ! empty( $input['slug'] ) ) {
                $postarr['post_name'] = sanitize_title( (string) $input['slug'] );
            }

            $id = wp_insert_post( $postarr, true );

            if ( is_wp_error( $id ) ) {
                return $id;
            }

            return [
                'id'     => $id,
                'link'   => get_permalink( $id ),
                'status' => get_post_status( $id ),
            ];
        },
        'permission_callback' => function () {
            return current_user_can( 'publish_pages' ) || current_user_can( 'edit_pages' );
        },
        'meta' => [ 'public' => true ],
    ] );

    wp_register_ability( 'wpstack/update-page', [
        'label'         => 'Update Page',
        'description'   => 'Updates an existing WordPress page\'s title, content, and/or status. Content, if provided, is validated against wpstack block rules before being written.',
        'category'      => 'wpstack',
        'input_schema'  => [
            'type'       => 'object',
            'properties' => [
                'id'      => [ 'type' => 'integer' ],
                'title'   => [ 'type' => 'string' ],
                'content' => [ 'type' => 'string', 'description' => 'Serialized Gutenberg block markup.' ],
                'status'  => [ 'type' => 'string', 'enum' => [ 'draft', 'publish', 'pending', 'private' ] ],
            ],
            'required'   => [ 'id' ],
        ],
        'output_schema' => [
            'type'       => 'object',
            'properties' => [
                'id'     => [ 'type' => 'integer' ],
                'link'   => [ 'type' => 'string' ],
                'status' => [ 'type' => 'string' ],
            ],
        ],
        'execute_callback'    => function ( $input ) {
            $id = (int) ( $input['id'] ?? 0 );

            if ( $id <= 0 ) {
                return new WP_Error( 'wpstack_invalid_input', 'id is required.' );
            }

            $existing = get_post( $id );
            if ( ! $existing || 'page' !== $existing->post_type ) {
                return new WP_Error( 'wpstack_page_not_found', 'No page found for the given id.' );
            }

            $postarr = [ 'ID' => $id ];

            if ( isset( $input['title'] ) ) {
                $postarr['post_title'] = sanitize_text_field( (string) $input['title'] );
            }

            if ( isset( $input['content'] ) ) {
                $validation = wpstack_validate_block_markup( (string) $input['content'] );
                if ( ! $validation['valid'] ) {
                    return new WP_Error( 'wpstack_block_validation_failed', 'Block markup failed validation.', $validation['errors'] );
                }
                $postarr['post_content'] = (string) $input['content'];
            }

            if ( isset( $input['status'] ) && in_array( $input['status'], [ 'draft', 'publish', 'pending', 'private' ], true ) ) {
                $postarr['post_status'] = (string) $input['status'];
            }

            $result = wp_update_post( $postarr, true );

            if ( is_wp_error( $result ) ) {
                return $result;
            }

            return [
                'id'     => $id,
                'link'   => get_permalink( $id ),
                'status' => get_post_status( $id ),
            ];
        },
        'permission_callback' => function ( $input ) {
            $id = (int) ( $input['id'] ?? 0 );
            return $id > 0 ? current_user_can( 'edit_post', $id ) : false;
        },
        'meta' => [ 'public' => true ],
    ] );
} );
