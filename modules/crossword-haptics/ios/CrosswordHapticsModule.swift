import ExpoModulesCore
import UIKit

public class CrosswordHapticsModule: Module {
  private var generator: UIImpactFeedbackGenerator?

  public func definition() -> ModuleDefinition {
    Name("CrosswordHaptics")

    AsyncFunction("prepare") {
      self.impactGenerator().prepare()
    }
    .runOnQueue(.main)

    AsyncFunction("impact") {
      let generator = self.impactGenerator()
      generator.impactOccurred()
      // The engine returns to idle after an impact. Ready it for the next key.
      generator.prepare()
    }
    .runOnQueue(.main)

    AsyncFunction("release") {
      self.generator = nil
    }
    .runOnQueue(.main)
  }

  private func impactGenerator() -> UIImpactFeedbackGenerator {
    if let generator {
      return generator
    }
    let generator = UIImpactFeedbackGenerator(style: .heavy)
    self.generator = generator
    return generator
  }
}
