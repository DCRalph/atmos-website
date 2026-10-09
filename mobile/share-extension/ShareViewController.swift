import UIKit
import UniformTypeIdentifiers
/** Store a handoff locally. The extension has no session or network access. */
final class ShareViewController: UIViewController {
  private let status = UILabel()
  private let save = UIButton(type: .system)
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    let title = UILabel(); title.text = "SHARE TO ATMOS"; title.font = UIFont(name: "AtmosHeading-Black", size: 24) ?? .systemFont(ofSize: 24, weight: .black); title.textColor = .white
    status.text = "Save this chat, then open Atmos → Tasks → Add to review it."; status.textColor = .white; status.font = UIFont(name: "AtmosBody-Regular", size: 15); status.numberOfLines = 0
    save.setTitle("Save for Tasks", for: .normal); save.backgroundColor = UIColor(red: 198/255, green: 1, blue: 51/255, alpha: 1); save.setTitleColor(.black, for: .normal); save.titleLabel?.font = UIFont(name: "AtmosDisplay-Bold", size: 17) ?? .systemFont(ofSize: 17, weight: .bold); save.layer.cornerRadius = 24; save.heightAnchor.constraint(equalToConstant: 48).isActive = true
    save.addTarget(self, action: #selector(saveShare), for: .touchUpInside)
    let cancel = UIButton(type: .system); cancel.setTitle("Cancel", for: .normal); cancel.setTitleColor(.white, for: .normal); cancel.titleLabel?.font = UIFont(name: "AtmosDisplay-Bold", size: 15); cancel.addTarget(self, action: #selector(cancelShare), for: .touchUpInside)
    let stack = UIStackView(arrangedSubviews: [title, status, save, cancel]); stack.axis = .vertical; stack.spacing = 24; stack.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(stack)
    NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24), stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24), stack.centerYAnchor.constraint(equalTo: view.centerYAnchor)])
  }
  @objc private func cancelShare() { extensionContext?.cancelRequest(withError: NSError(domain: "AtmosShare", code: 1)) }
  @objc private func saveShare() {
    save.isEnabled = false
    Task { @MainActor in
      do {
        guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.nz.co.atmosmedia.app") else { throw NSError(domain: "AtmosShare", code: 2) }
        let handoff = root.appendingPathComponent("TaskShares", isDirectory: true)
        let folder = handoff.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
        var texts: [String] = []; var images: [[String: String]] = []
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        for provider in providers {
          if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier), images.count < 5 {
            if let identifier = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .image) == true }) {
              let data: Data = try await withCheckedThrowingContinuation { continuation in
                provider.loadDataRepresentation(forTypeIdentifier: identifier) { data, error in
                  if let data { continuation.resume(returning: data) } else { continuation.resume(throwing: error ?? NSError(domain: "AtmosShare", code: 3)) }
                }
              }
              guard data.count <= 15 * 1024 * 1024, let image = UIImage(data: data),
                let jpeg = image.jpegData(compressionQuality: 0.9), jpeg.count <= 15 * 1024 * 1024 else { throw NSError(domain: "AtmosShare", code: 4) }
              let name = "chat-\(images.count + 1).jpg"; let file = folder.appendingPathComponent(name)
              try jpeg.write(to: file, options: [.atomic, .completeFileProtection])
              images.append(["name": name, "type": "image/jpeg"])
            }
          } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            let item: NSSecureCoding = try await withCheckedThrowingContinuation { continuation in
              provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, error in
                if let item { continuation.resume(returning: item) } else { continuation.resume(throwing: error ?? NSError(domain: "AtmosShare", code: 3)) }
              }
            }
            if let text = item as? String { texts.append(text) }
          }
        }
        let text = String(texts.joined(separator: "\n").prefix(30_000))
        guard !text.isEmpty || !images.isEmpty else { throw NSError(domain: "AtmosShare", code: 5) }
        let manifest: [String: Any] = ["folder": folder.lastPathComponent, "text": text, "images": images, "createdAt": Date().timeIntervalSince1970]
        let data = try JSONSerialization.data(withJSONObject: manifest)
        try data.write(to: handoff.appendingPathComponent("pending.json"), options: [.atomic, .completeFileProtection])
        // Keep only the latest handoff; a second share must not leak abandoned images.
        for old in try FileManager.default.contentsOfDirectory(at: handoff, includingPropertiesForKeys: nil) where old.lastPathComponent != "pending.json" && old != folder { try? FileManager.default.removeItem(at: old) }
        extensionContext?.completeRequest(returningItems: nil)
      } catch {
        status.text = "Couldn’t save this share. Try copied text or up to five screenshots under 15 MB each."
        save.isEnabled = true
      }
    }
  }
}
