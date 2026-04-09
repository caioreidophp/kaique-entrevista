<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        // Ensure tests NEVER touch the production database.
        // If config is cached, env() overrides from phpunit.xml are ignored,
        // causing migrate:fresh to wipe the real SQLite file.
        $configCache = dirname(__DIR__).'/bootstrap/cache/config.php';
        if (file_exists($configCache)) {
            unlink($configCache);
        }

        $routeCaches = glob(dirname(__DIR__).'/bootstrap/cache/routes-*.php') ?: [];
        $routeCaches[] = dirname(__DIR__).'/bootstrap/cache/routes.php';

        foreach ($routeCaches as $routeCache) {
            if (file_exists($routeCache)) {
                unlink($routeCache);
            }
        }

        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
        ]);
    }
}
