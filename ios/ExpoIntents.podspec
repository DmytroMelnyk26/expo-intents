require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoIntents'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/DmytroMelnyk26/expo-intents.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'JavaScriptCore'

  s.source_files = "**/*.{h,m,swift}"

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Build the standalone JS bundle (ExpoIntents.bundle) before compiling, then copy it into the
  # built products so `Bundle.main` can find it at runtime. Mirrors expo-widgets' approach.
  project_root_env_var = ENV['PROJECT_ROOT'] ? "export PROJECT_ROOT=#{ENV['PROJECT_ROOT']}\n" : ""
  build_bundle_script = {
    :name => 'Build ExpoIntents Bundle',
    :script => project_root_env_var + 'bash -l -c "$PODS_TARGET_SRCROOT/../scripts/xcode-build-bundle.sh"',
    :execution_position => :before_compile,
    :input_files  => ["#{__dir__}/../package.json"],
    :output_files => ["#{__dir__}/../bundle/build/ExpoIntents.bundle"],
  }
  copy_bundle_script = {
    :name => 'Prepare ExpoIntents Resources',
    :script => %Q{
      echo "Preparing ExpoIntents.bundle..."
      source="#{__dir__}/../bundle/build/ExpoIntents.bundle"
      dest="${BUILT_PRODUCTS_DIR}/ExpoIntents.bundle"
      echo "Copying ${source} to ${dest}"
      cp "${source}" "${dest}"
    },
    :execution_position => :before_compile,
    :input_files  => ["#{__dir__}/../bundle/build/ExpoIntents.bundle"]
  }
  # :always_out_of_date is only available in CocoaPods 1.13.0 and later
  if Gem::Version.new(Pod::VERSION) >= Gem::Version.new('1.13.0')
    copy_bundle_script[:always_out_of_date] = "1"
  end
  s.script_phases = [build_bundle_script, copy_bundle_script]
  s.resource_bundles = {
    'ExpoIntents' => [],
  }
end
