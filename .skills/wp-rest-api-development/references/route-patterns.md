# Route Patterns

Use this reference when reviewing how WordPress REST routes are registered and organized.

## Good Defaults

- Register routes on `rest_api_init`
- Use a namespaced path with versioning such as `my-plugin/v1`
- Keep route shape predictable across collections and single resources
- Prefer controller classes when route count grows

## Common Problems

- Inline anonymous callbacks everywhere
- Route namespaces without versioning
- Read and write actions mixed under unclear paths
- Callbacks that directly touch globals instead of `WP_REST_Request`

## Good Pattern

```php
add_action(
    'rest_api_init',
    function () {
        register_rest_route(
            'my-plugin/v1',
            '/items/(?P<id>\d+)',
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => 'my_plugin_get_item',
                'permission_callback' => 'my_plugin_can_view_item',
                'args'                => array(
                    'id' => array(
                        'validate_callback' => 'is_numeric',
                    ),
                ),
            )
        );
    }
);
```

